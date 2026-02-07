export const uploadToCloudinary = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error("Missing Cloudinary configuration. Check .env.local");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Optional: Add folder if you want to organize uploads
    // formData.append("folder", "digipol_evidence"); 

    // Use 'auto' resource type to let Cloudinary determine the best handling.
    // This avoids the access restriction issues seen with 'raw' while still supporting PDFs/files.
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Cloudinary Upload Failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url; // Returns the HTTPS URL of the uploaded image
};
