import axios from "axios";

const api = axios.create({
    baseURL: "https://selfserv-1.onrender.com/api",
    withCredentials: true,
});

export default api;
