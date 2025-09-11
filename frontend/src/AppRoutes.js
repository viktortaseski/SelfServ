// src/AppRoutes.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import WaiterLogin from "./components/WaiterLogin";

function AppRoutes() {
    return (
        <Router>
            <Routes>
                {/* Customer flow (menu, cart, etc.) */}
                <Route path="/*" element={<App />} />

                {/* Waiter/Admin flow */}
                <Route path="/waiter-login" element={<WaiterLogin />} />
            </Routes>
        </Router>
    );
}

export default AppRoutes;
