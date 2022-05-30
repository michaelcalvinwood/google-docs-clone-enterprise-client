import './styles.css';
import React, {useCallback, useEffect, useRef } from 'react';
import Quill from 'quill';
import "quill/dist/quill.snow.css";

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
        new Quill(editor, settings);

        return;
    }, []);

    return (
    <div className="container" ref={wrapperRef}>
        
    </div>
  )
}

export default 
TextEditor