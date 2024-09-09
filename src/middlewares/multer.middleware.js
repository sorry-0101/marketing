import multer from "multer";

// Configure storage for multer
const storage = multer.diskStorage({
	// Specify the destination where files will be stored
	destination: function (req, file, cb) {
		// The 'cb' (callback) function is used to pass the directory path for file uploads
		cb(null, "./public/temp"); // Files are stored in the "./public/temp" directory
	},
	// Define the filename for the uploaded file
	filename: function (req, file, cb) {
		// The 'cb' function sets the file's original name as the stored file name
		cb(null, file.originalname); // Use the original name of the file for saving
	}
});

// Export the multer configuration for handling file uploads
export const upload = multer({
	storage, // Use the defined storage configuration
});
