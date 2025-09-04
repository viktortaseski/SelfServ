import axios from "axios";

const api = axios.create({
    baseURL: "https://selfserv.onrender.com/api", // backend running here
});

export default api;
