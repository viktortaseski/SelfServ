import axios from "axios";

const api = axios.create({
    baseURL: "https://selfserv.onrender.com/api",
    withCredentials: true,
});

export default api;
