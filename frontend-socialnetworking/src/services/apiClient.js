import axios from "axios";

export const apiPublicClient = (baseURL) => {
    return axios.create({
        baseURL,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

export const apiPrivateClient = (baseURL) => {
    return axios.create({
        baseURL,
        withCredentials: true,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

// const setCookie = (name, value, days= 7, secure = true) => {
//     const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
//     document.cookie = `${name}=${value}; expires=${expires}; path=/; ${secure ? 'Secure; SameSite=None;' : ''}`;
// };
export const setCookie = (name, value, minute= 30, secure = true) => {
    const expires = new Date(Date.now() + minute * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; ${secure ? 'Secure; SameSite=None;' : ''}`;
};
export const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
};
export const removeCookie = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

export const getAuthHeader = () => {
    const token = getCookie('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

export const uploadFileToCloudinary = async (file) => {
  let endpoint = "raw";
  if (file.type.startsWith("image/")) endpoint = "image";
  else if (file.type.startsWith("video/")) endpoint = "video";

  const url = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${endpoint}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

  const response = await axios.post(url, formData);
  return response.data.secure_url; // URL file public
};
