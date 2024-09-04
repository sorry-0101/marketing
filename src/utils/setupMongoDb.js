import mongoose from "mongoose";
import { DB_NAME } from "../globalVar.js";
const connectDB = async (param) => {
	try {
		const connectionInstance = await mongoose.connect(param.mongodb_uri);
		console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
	} catch (error) {
		console.log("MONGODB connection FAILED ", error);
		process.exit(1);
	}
}

export default connectDB;