import './styles.css';
import React, {useCallback, useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import "quill/dist/quill.snow.css";
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';

const SAVE_INERVAL_MS = 5000;
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

const TextEditor = () => {
    const {id: documentId} = useParams();
    const [socket, setSocket] = useState();
    const [quill, setQuill] = useState();

    useEffect(() => {
        const s = io("http://localhost:7201");
        setSocket(s);

        return () => {
            s.disconnect();
        }
    }, [])

    useEffect(() => {
        if (socket == null || quill == null) return;

        const interval = setInterval(() => {
            socket.emit('save-document', quill.getContents());
        }, SAVE_INERVAL_MS);

        return () => {
            clearInterval(interval);
        }
    }, [socket, quill])


    // Load initial document and resetDocument when needed
    useEffect(() => {
        console.log('load initial document', socket, quill);
        if (socket == null || quill == null) return;
        
        // socket.once('load-document', document => {
        //     quill.setContents(document);
        //     quill.enable();
        // });

        socket.once('getInitialDocument', deltas => {
            console.log('initialDocument', deltas);
            quill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                console.log('parsed', parsed)
                quill.updateContents(parsed);
            });

            // console.log('contents', contents, typeof contents);
            // quill.setContents(contents);
            quill.enable();
        });

        socket.on('resetDocument', deltas => {
            console.log('on resetDocument', deltas);
            quill.setContents('');
            const contents = deltas.forEach(delta => {
                const parsed = JSON.parse(delta);
                console.log('parsed', parsed)
                quill.updateContents(parsed);
                // move cursor to end of contents
                quill.setSelection(quill.getLength(), 0);
            });
        } )

        socket.emit('getInitialDocument', documentId);

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
            if (source !== 'user') return;

            socket.emit("newDelta", delta, 1);
        }

        quill.on('text-change', newDeltaHandler);

        return () => {
            quill.off('text-change', newDeltaHandler);
        }
    }, [socket, quill])

    const wrapperRef = useCallback((wrapper) => {
        if (wrapper == null) return;
        wrapper.innerHTML = '';
        
        const editor = document.createElement('div');
        wrapper.append(editor);

        const settings = {
            theme: "snow",
            modules: {
                toolbar: TOOLBAR_OPTIONS
            }
        }
        
        const q = new Quill(editor, settings);
        q.disable();
        q.setText('Loading...')
        setQuill(q);

        return;
    }, []);

    return (
    <div className="container" ref={wrapperRef}>
        
    </div>
  )
}

export default 
TextEditor