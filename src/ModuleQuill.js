import './ModuleQuill.scss';
import React, {createElement, useCallback, useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import "quill/dist/quill.snow.css";
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import {useDropzone} from 'react-dropzone';
import axios from 'axios';
import { Audio } from  'react-loader-spinner';
import {QuillDeltaToHtmlConverter} from 'quill-delta-to-html';
// import {htmlDocx} from 'html-docx-js';
// import htmlDocx from 'html-docx-js/dist/html-docx';
import { saveAs } from 'file-saver';

// for different spinner options see https://www.npmjs.com/package/react-loader-spinner
//https://www.npmjs.com/package/html-to-docx

window.pdfAlert = true;
window.docAlert = true;

const TextEditor = () => {
    const {id: documentId} = useParams();
    const [socket, _setSocket] = useState();
    const [quill, _setQuill] = useState();
    const [images, _setImages] = useState();
    const [insertImage, setInsertImage] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("Drag 'n' drop some files here, or click to select files");
    const [mailLink, setMailLink] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [cleanDocument, setCleanDocument] = useState(false);
    

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
        ["clean", "word", "pdf", "mail"],
    ]    

    if (!window.googleDocsClone) window.googleDocsClone = {};

    const getHtml = () => {
        const curQuill = quillRef.current;
        const editor = document.querySelector('.module-quill__editor');
        const htmlOutput = document.querySelector('.module-quill__html-output');
        
        const deltas = curQuill.getContents();
        let converter = new QuillDeltaToHtmlConverter(deltas.ops, {});
        let html = converter.convert();
        return html;
    }
    
    const imageHandler = () => setInsertImage(true);
    const mailHandler = () => setMailLink(true);
    const wordHandler = async () => {
        setIsDownloading(true);
        const html = getHtml();
        socketRef.current.emit('downloadWord', html, documentId);
    }
    const pdfHandler = async () => {
        setIsDownloading(true);
        const html = getHtml();
        socketRef.current.emit('downloadPdf', html, documentId);
    }
    const cleanHandler = () => {
        setCleanDocument(true);
    }
    const cleanDocumentHandler = () => {
        setCleanDocument(false);
        setIsDownloading(true);
        socketRef.current.emit('cleanDocument', documentId);
    }

    // useEffect []
    useEffect(() => {
        const s = io("https://google-docs-clone.appgalleria.com:7201");
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
                        mail: mailHandler,
                        word: wordHandler,
                        pdf: pdfHandler,
                        clean: cleanHandler
                    }
                },
               
            }
        }
        
        const q = new Quill(editor, settings);
        q.setText('Loading...')
        setQuill(q);

        const getUploadUrl = async result => {
            const selectedImages = imagesRef.current;

            axios.defaults.headers.put['Access-Control-Allow-Origin'] = '*';

            for (let i = 0; i < result.length; ++i) {
                const selectedImage = selectedImages.find(image => image.path === result[i].path);

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
                    const curQuill = quillRef.current;
                    const range = curQuill.selection.savedRange;
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
            setIsDownloading(false);
            const curQuill = quillRef.current;
            
            curQuill.disable();
            curQuill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                curQuill.updateContents(parsed);
            });
            curQuill.enable();
            window.googleDocsClone.nextIndex = deltas.length + 1;
            
            const curLength = curQuill.getLength();
            const {cursorIndex} = window.googleDocsClone;

            if (cursorIndex && cursorIndex < curLength) curQuill.setSelection(cursorIndex, 0);
            else curQuill.setSelection(curLength, 0);
        }

        s.on('getInitialDocument', getInitialDocument);

        const newDelta = (delta, nextIndex, sourceId) => {
            window.googleDocsClone.nextIndex = nextIndex;
            const curQuill = quillRef.current;
            if (sourceId !== s.id) curQuill.updateContents(delta);
        }

        s.on('newDelta', newDelta);

        s.on('downloadWord', link => {
            setIsDownloading(false); 
            if (!link && window.docAlert){   
                alert("Error creating Word Document. Please try PDF.");
                window.docAlert = false;
                return;
            }
            if (!link) return;

            const newWin = window.open(link);

            if (!newWin || newWin.closed || typeof newWin.closed == "undefined") {
                alert('Please enable popups for this site to download documents.');
            }

                       
        })

        s.on('downloadPdf', link => {
            setIsDownloading(false);  
            if (!link && window.pdfAlert) {
                alert("Error creating PDF Document. Please try Word.");
                window.pdfAlert = false;
                return;
            }

            if (!link) return;

            const newWin = window.open(link);

            if (!newWin || newWin.closed || typeof newWin.closed == "undefined") {
                alert('Please enable popups for this site to download documents.');
            }

                      
        })

        return () => {
            s.off('get-upload-url', getUploadUrl);
            s.off('getInitialDocument', getInitialDocument);
            s.off('newDelta', newDelta);
            s.disconnect();
        }

    }, [])

    // useEffect [socket, quill, documentId]
    useEffect(() => {
        if (socket == null || quill == null) return;
        
        socket.emit('getInitialDocument', documentId);

    }, [socket, quill, documentId])


    // useEffect [socket, quill]
    useEffect(() => {
        if (socket == null || quill == null) return;

        const textChange = (delta, oldDelta, source) => {
            if (source !== 'user') return;

            const curPosition = quill.getSelection();

            if (curPosition) window.googleDocsClone.cursorIndex = curPosition.index;

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

        const signatureData = filteredFiles.map(file => {
            const path = file.path;
            const extension = getFileExtension(file.name);
            const fileType =  getPrimaryFileType(file.type);
            return ({
                path,
                extension,
                fileType
            })
        })

        setImages(filteredFiles);
        socketRef.current.emit('get-upload-url', signatureData, documentId)    
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
        {
            mailLink &&
            <div className='module-quill__mail-container'>
                <div className='module-quill__mail'>
                    <p className='module-quill__mail-instructions'>
                        Send the document link to your colleagues.
                   
                        <a href={`mailto:?subject=Let's Collaborate&body=Please go to the following link to start collaborating together: https://google-docs-clone.appgalleria.com/documents/${documentId}`}>
                            <button
                                className='module-quill__sendMail'
                                onClick={()=>setMailLink(false)}
                            >
                            Send
                            </button>
                        </a>
                        <button
                            className='module-quill__cancelMail'
                            onClick={()=>setMailLink(false)}
                        >
                        Cancel
                        </button>
                    </p>
                </div>
            </div>
        }
        {
            isDownloading &&
            <div className='module-quill__is-downloading-container'>
                <Audio />
            </div>
        }
        {
            cleanDocument &&
            <div className='module-quill__clean-document-container'>
                <div className='module-quill__clean-document'>
                    <p className="module-quill__clean-document-instructions">
                        Are you sure that you want to erase the document contents? This cannot be undone.
                    
                        <button
                            className='module-quill__clean-document-confirm'
                            onClick={cleanDocumentHandler}
                        >
                            Yes
                        </button>
                        <button
                            className='module-quill__clean-document-cancel'
                            onClick={()=>setCleanDocument(false)}
                        >
                            Cancel
                        </button>
                    </p>
                </div>
            </div>
        }
    </div>
  )
}

export default 
TextEditor