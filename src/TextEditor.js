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
        const s = io("http://localhost:3001");
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
    useEffect(() => {
        if (socket == null || quill == null) return;

        socket.once('load-document', document => {
            quill.setContents(document);
            quill.enable();
        });

        socket.emit('get-document', documentId);

    }, [socket, quill, documentId])

    useEffect(() => {
        if (socket == null || quill == null) return;

        const handler = (delta) => {
           quill.updateContents(delta);
        }

        socket.on('receive-changes', handler);

        return () => {
            socket.off('receive-changes', handler);
        }
    }, [socket, quill])

    useEffect(() => {
        if (socket == null || quill == null) return;

        const handler = (delta, oldDelta, source) => {
            if (source !== 'user') return;

            socket.emit("send-changes", delta);
        }

        quill.on('text-change', handler);

        return () => {
            quill.off('text-change', handler);
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