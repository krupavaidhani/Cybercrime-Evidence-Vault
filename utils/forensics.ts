/**
 * Hashing utility for forensic integrity.
 * Uses the Web Crypto API (SubtleCrypto) for high-performance hashing of large files.
 * This runs entirely on the client side - the file content is never sent to the server for hashing.
 */
export async function generateFileHash(file: File): Promise<string> {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API is not supported in this environment");
    }

    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return formatted as a 0x hex string for consistency with standard blockchain tools
    return "0x" + hashHex;
}
