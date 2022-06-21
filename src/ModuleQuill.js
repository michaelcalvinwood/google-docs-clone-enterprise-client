import './ModuleQuill.scss';
import React, {useCallback, useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import "quill/dist/quill.snow.css";
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import {useDropzone} from 'react-dropzone';
import axios from 'axios';
import { Audio } from  'react-loader-spinner'
// for different spinner options see https://www.npmjs.com/package/react-loader-spinner


const TextEditor = () => {
    const {id: documentId} = useParams();
    const [socket, _setSocket] = useState();
    const [quill, _setQuill] = useState();
    const [images, _setImages] = useState();
    const [insertImage, setInsertImage] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("Drag 'n' drop some files here, or click to select files");

    const socketRef = useRef(socket);
    const quillRef = useRef(quill);
    const imagesRef = useRef(images);

    // special state setters for values that need to be synchronously accessed and/or accessed within event handlers

    const setQuill = val => {
        quillRef.current = val;
        _setQuill(val);
    }

    const setSocket = s => {
        socketRef.current = s;
        _setSocket(s);
    }

    const setImages = i => {
        imagesRef.current = i;
        _setImages(i);
    }

    const TOOLBAR_OPTIONS = [
        [{ font: [] }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ script:  "sub" }, { script:  "super" }],
        ["blockquote", "code-block"],
        [{ list:  "ordered" }, { list:  "bullet" }],
        [{ indent:  "-1" }, { indent:  "+1" }, { align: [] }],
        ["link", "image", "video", "code-block"],
        ["clean"],
    ]    

    if (!window.googleDocsClone) window.googleDocsClone = {};
    if (!window.debugCounter) window.debugCounter = 1;

    const imageHandler = () => setInsertImage(true);
    
    // useEffect []
    useEffect(() => {
        const s = io("https://google-docs-clone.appgalleria.com:7201");
        console.log('socket connection', s);
        setSocket(s);

        const wrapper = document.querySelector('.module-quill__editor');
        if (wrapper == null) {
            console.error('Cannot locate .module-quill__editor');
            return;
        }

        wrapper.innerHTML = '';
        
        const editor = document.createElement('div');
        wrapper.append(editor);

        const settings = {
            theme: "snow",
            modules: {
                toolbar: {
                    container: TOOLBAR_OPTIONS,
                    handlers: {
                        image: imageHandler,
                    }
                },
               
            }
        }
        
        const q = new Quill(editor, settings);
        q.setText('Loading...')
        console.log('setQuill', q);
        setQuill(q);

        const getUploadUrl = async result => {
            console.log('on get-upload-url', result);
            const selectedImages = imagesRef.current;

            console.log(selectedImages);

            axios.defaults.headers.put['Access-Control-Allow-Origin'] = '*';

            for (let i = 0; i < result.length; ++i) {
                const selectedImage = selectedImages.find(image => image.path === result[i].path);

                console.log('selectedImage', selectedImage);
                const request = {
                    url: result[i].url,
                    method: 'put',
                    data: selectedImage,
                    headers: {
                        'Content-Type': 'image',
                        'x-amz-acl': 'public-read',
                    }
                }

                try {
                    setUploadMessage(`Processing file #${i+1}`);
                    setUploadingImages(true);
                    const response = await axios(request);
                    console.log(response);
                    const curQuill = quillRef.current;
                    console.log('quill', curQuill)
                    const range = curQuill.selection.savedRange;
                    console.log('range', range);
                    const value = `https://google-docs-clone.nyc3.digitaloceanspaces.com/${result[i].fileName}`;
                
                    curQuill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
                    
                } catch(e) {
                    console.error(e);
                }
            }

            setInsertImage(false);
            setUploadingImages(false);
            setUploadMessage("Drag 'n' drop some files here, or click to select files");   
        }

        s.on('get-upload-url', getUploadUrl);

        const getInitialDocument = deltas => {
            console.log('initialDocument', deltas);
            const curQuill = quillRef.current;
            
            curQuill.disable();
            curQuill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                console.log('parsed', parsed)
                curQuill.updateContents(parsed);
            });
            curQuill.enable();
            window.googleDocsClone.nextIndex = deltas.length + 1;
            
            const curLength = curQuill.getLength();
            const {cursorIndex} = window.googleDocsClone;

            if (cursorIndex && cursorIndex < curLength) curQuill.setSelection(cursorIndex, 0);
            else curQuill.setSelection(curLength, 0);
            console.log('NextIndex', window.googleDocsClone.nextIndex);
        }

        s.on('getInitialDocument', getInitialDocument);

        const newDelta = (delta, nextIndex, sourceId) => {
            console.log('newDeltaHandler', delta, nextIndex, sourceId, s.id);
            window.googleDocsClone.nextIndex = nextIndex;
            console.log('NextIndex', window.googleDocsClone.nextIndex);
            const curQuill = quillRef.current;
            if (sourceId !== s.id) curQuill.updateContents(delta);
        }

        s.on('newDelta', newDelta);

        return () => {
            s.off('get-upload-url', getUploadUrl);
            s.off('getInitialDocument', getInitialDocument);
            s.off('newDelta', newDelta);
            s.disconnect();
        }
    }, [])

    // useEffect [socket, quill, documentId]
    useEffect(() => {
        console.log('load initial document', socket, quill);
        if (socket == null || quill == null) return;
        
        socket.emit('getInitialDocument', documentId);

    }, [socket, quill, documentId])


    // useEffect [socket, quill]
    useEffect(() => {
        if (socket == null || quill == null) return;

        const textChange = (delta, oldDelta, source) => {
            console.log('on text-change', delta, oldDelta, source);

            if (source !== 'user') return;

            const curPosition = quill.getSelection();

            if (curPosition) window.googleDocsClone.cursorIndex = curPosition.index;

            if(window.debugCounter) {
                ++window.debugCounter;
                console.log('debugCounter', window.debugCounter);

                if (window.debugCounter >= 5) {
                    socket.emit("newDelta", documentId, delta, 0); 
                    window.debugCounter = 1;
                    return;       
                }
            }
            socket.emit("newDelta", documentId, delta, window.googleDocsClone.nextIndex);
        }

        quill.on('text-change', textChange);

        return () => {
            quill.off('text-change', textChange);
        }
    }, [socket, quill])

    const getFileExtension = fileName => {
        const loc = fileName.lastIndexOf('.');
        if (loc === -1) return false;
        return fileName.substring(loc+1).toLowerCase();
    }

    const getPrimaryFileType = fileType => {
        const loc = fileType.indexOf('/');
        if (loc === -1) return fileType;
        return fileType.substring(0, loc);
    }

    // useCallback []
    const onDrop =  useCallback(acceptedFiles => {
        const filteredFiles = acceptedFiles.filter(file => {
            const extension = getFileExtension(file.name);
            switch(extension) {
                case 'png':
                case 'jpeg':
                case 'jpg':
                case 'gif':
                    return true;
                default:
                    return false;
            }
        })
        
        if (!filteredFiles.length) {
            alert('Please select an image file');
            return;
        }

        if (filteredFiles.length > 100) {
            alert('Please select 100 files or less.');
        }

        console.log('filteredFiles', filteredFiles);

        const signatureData = filteredFiles.map(file => {
            const path = file.path;
            const extension = getFileExtension(file.name);
            const fileType =  getPrimaryFileType(file.type);
            console.log(path, extension, fileType)
            return ({
                path,
                extension,
                fileType
            })
        })

        console.log(socketRef.current)

        setImages(filteredFiles);
        socketRef.current.emit('get-upload-url', signatureData)

        console.log('emit get-upload-url', signatureData, documentId);
    
    }, [])

    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
    <div className="module-quill">
        <div className='module-quill__html-output'></div>
        {/* <div className="module-quill__editor" ref={wrapperRef} /> */}
        <div className="module-quill__editor" />
        { insertImage &&
            <div 
                {...getRootProps()}
                className='module-quill__dropzone-area'>
                <input 
                    {...getInputProps()} 
                    className='module-quill__dropzone-input'/>
                <p className='module-quill__instructions'>
                    {uploadMessage}
                    {uploadingImages ? 
                        <Audio /> :
                        <button className='module-quill__cancel-image-button'
                            onClick={(e) => {
                                e.stopPropagation();
                                setInsertImage(false)
                                }
                            }>
                            Cancel
                        </button>
                    }
                </p>
           </div>
        }
    </div>
  )
}

export default 
TextEditor