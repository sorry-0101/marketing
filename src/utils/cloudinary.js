import { v2 as cloudinary } from "cloudinary"
import { join, normalize } from 'path';
import fs from "fs"

// TODO: need to look into this why values are not getting form env
cloudinary.config({
	cloud_name: 'dqc19jdwd' || process.env.CLOUDINARY_CLOUD_NAME,
	api_key: '821619143512213' || process.env.CLOUDINARY_API_KEY,
	api_secret: 'SAf3_kDncWab4P2IkmfSlL0V-Sg' || process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
	try {
		if (!localFilePath) return null

		const normalizedPath = localFilePath.replace(/\\/g, '/'); // Replace all backslashes with forward slashes

		//upload the file on cloudinary
		const response = await cloudinary.uploader.upload(normalizedPath, {
			resource_type: "auto"
		})
		// file has been uploaded successfull
		console.log("file is uploaded on cloudinary ", response.url);
		fs.unlinkSync(localFilePath)
		return response;

	} catch (error) {
		fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
		return null;
	}
}



export { uploadOnCloudinary }