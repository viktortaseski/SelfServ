import { HashRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import Dashboard from './admin/Dashboard.js'

function AppRoutes() {
    return (
        <Router>
            <Routes>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/*" element={<App />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
