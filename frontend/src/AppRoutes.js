import { HashRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";

function AppRoutes() {
    return (
        <Router>
            <Routes>
                <Route path="/*" element={<App />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
