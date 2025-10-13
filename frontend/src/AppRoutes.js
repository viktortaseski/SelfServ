import { HashRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import Admin from './admin/Admin.js'

function AppRoutes() {
    return (
        <Router>
            <Routes>
                <Route path="/admin" element={<Admin />} />
                <Route path="/*" element={<App />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
