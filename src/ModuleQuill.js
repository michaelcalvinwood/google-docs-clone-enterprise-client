import './ModuleQuill.scss';
import React, {useCallback, useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import "quill/dist/quill.snow.css";
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import {useDropzone} from 'react-dropzone';

const TextEditor = () => {
    const {id: documentId} = useParams();
    const [socket, setSocket] = useState();
    const [quill, _setQuill] = useState();
    const [insertImage, setInsertImage] = useState(false);

    const quillRef = useRef(quill);

    // special state setters for values that need to be synchronously accessed
    const setQuill = val => {
        quillRef.current = val;
        _setQuill(val);
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

    const imageHandler = () => {
        
        setInsertImage(true);
    }

    useEffect(() => {
        const s = io("http://localhost:7201");
        setSocket(s);

        return () => {
            s.disconnect();
        }
    }, [])

    // Load initial document and resetDocument when needed
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

    
    // change document when new delta arrives
    useEffect(() => {
        if (socket == null || quill == null) return;

        const newDeltaHandler = (delta, index) => {
            console.log('newDeltaHandler', delta, index);
           quill.updateContents(delta);
        }

        socket.on('newDelta', newDeltaHandler);

        return () => {
            socket.off('newDelta', newDeltaHandler);
        }
    }, [socket, quill])


    // send new delta when document changes
    useEffect(() => {
        if (socket == null || quill == null) return;

        const newDeltaHandler = (delta, oldDelta, source) => {
            console.log('on text-change', delta);

            if (source !== 'user') return;

            socket.emit("newDelta", delta, 1);
        }

        quill.on('text-change', newDeltaHandler);

        return () => {
            quill.off('text-change', newDeltaHandler);
        }
    }, [socket, quill])

    // add quill editor whenever the component is rendered
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

    const onDrop =  useCallback(acceptedFiles => {
        console.log(acceptedFiles);
    
    }, [])

    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
    <div className="module-quill">
        <div className="module-quill__editor" ref={wrapperRef} />
        { insertImage &&
            <div 
                {...getRootProps()}
                className='module-quill__dropzone-area'>
                <input 
                    {...getInputProps()} 
                    className='module-quill__dropzone-input'/>
                <p className='module-quill__instructions'>
                    {   isDragActive ? 
                        "Drop the files here ..." : 
                        "Drag 'n' drop some files here, or click to select files"
                    }
                    <button className='module-quill__cancel-image-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        setInsertImage(false)
                        }
                    }>
                        Cancel
                    </button>
                </p>
                { 
                    
                    
                }
           </div>
        }
    </div>
  )
}

export default 
TextEditor