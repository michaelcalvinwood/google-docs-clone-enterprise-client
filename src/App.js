import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom'
import TextEditor from "./ModuleQuill";
import { v4 as uuidV4 } from 'uuid';
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/documents/:id" element={<TextEditor />}/>
        <Route path='/' element={<Navigate to={`/documents/${uuidV4()}`}/>}/>
      </Routes>
      
    </Router>
   
  );
}


export default App;
