// src/AppRoutes.js
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import WaiterLogin from "./components/WaiterLogin";

function AppRoutes() {
    return (
        <Router>
            <Routes>
                <Route path="/*" element={<App />} />
                <Route path="/waiter-login" element={<WaiterLogin />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
