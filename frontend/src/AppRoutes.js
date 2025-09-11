// src/AppRoutes.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App"; // customer-facing app
import WaiterLogin from "./components/WaiterLogin";

function AppRoutes() {
    return (
        <Router>
            <Routes>
                {/* Customer flow */}
                <Route path="/*" element={<App />} />

                {/* Waiter/Admin login */}
                <Route path="/waiter-login" element={<WaiterLogin />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
