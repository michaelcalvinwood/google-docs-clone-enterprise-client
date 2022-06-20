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

import { saveAs } from 'file-saver';
import * as quillToWord from 'quill-to-word';
import { pdfExporter } from 'quill-to-pdf';
import {QuillDeltaToHtmlConverter} from 'quill-delta-to-html';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TextEditor = () => {
    const {id: documentId} = useParams();
    const [socket, _setSocket] = useState();
    const [quill, _setQuill] = useState();
    const [images, _setImages] = useState();
    const [insertImage, setInsertImage] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("Drag 'n' drop some files here, or click to select files")

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
    
    const imageHandler = () => setInsertImage(true);
    
    // useEffect []
    useEffect(() => {
        const s = io("http://localhost:7201");
        setSocket(s);

        s.on('get-upload-url', async result => {
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
            
        })

        return () => {
            s.disconnect();
        }
    }, [])

    // useEffect [socket, quill, documentId]
    useEffect(() => {
        console.log('load initial document', socket, quill);
        if (socket == null || quill == null) return;
        
        socket.once('getInitialDocument', deltas => {
            console.log('initialDocument', deltas);
            
            quill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                console.log('parsed', parsed)
                quill.updateContents(parsed);
            });
            quill.enable();
            window.googleDocsClone.expectedIndex = deltas.length + 1;
        });

        socket.on('resetDocument', deltas => {
            console.log('on resetDocument', deltas);
            quill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                console.log('parsed', parsed)
                quill.updateContents(parsed);
            });

            // move cursor to end of contents
            quill.setSelection(quill.getLength(), 0);

        } )

        socket.emit('getInitialDocument', documentId);

        //TODO: use return to clean up socket event handlers

    }, [socket, quill, documentId])


    // useEffect [socket, quill]
    useEffect(() => {
        if (socket == null || quill == null) return;

        const receivedNewDeltaHandler = (delta, index) => {
            console.log('newDeltaHandler', delta, index);
            quill.updateContents(delta);
            window.googleDocsClone.expectedIndex = index;
        }

        socket.on('newDelta', receivedNewDeltaHandler);

        const newDeltaHandler = (delta, oldDelta, source) => {
            console.log('on text-change', delta);

            if (source !== 'user') return;

            socket.emit("newDelta", delta, window.googleDocsClone.expectedIndex);
        }

        quill.on('text-change', newDeltaHandler);

        return () => {
            quill.off('text-change', newDeltaHandler);
            socket.off('newDelta', receivedNewDeltaHandler);
        }
    }, [socket, quill])

    // useCallback []
    const wrapperRef = useCallback((wrapper) => {
        if (wrapper == null) return;
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
                        // word: downloadHandler,
                        // download: downloadHandler,
                        // pdf: pdfHandler
                    }
                },
               
            }
        }
        
        const q = new Quill(editor, settings);
        q.disable();
        q.setText('Loading...')
        console.log('setQuill', q);
        setQuill(q);

        return;
    }, []);

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
        <div className="module-quill__editor" ref={wrapperRef} />
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