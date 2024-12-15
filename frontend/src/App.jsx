import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from "./Pages/Home";

/* Import Pages here */

/* Import Pages here */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path="/" element={<Home />} />
        {/* Add other routes here */}
      </Routes>
    </BrowserRouter>
  );
}
