'use strict';
import axios from "axios";

function setupApiService(apiServiceDtl) {
	const host = apiServiceDtl.host,
		apiTimeOut = apiServiceDtl.api_timeout || 90000;

	global.api_service.get = async (req, url) => {
		const finalUrl = `${host}${url}`;
		const timeLog = [];
		timeLog.startTime = Date.now();

		try {
			const bearerToken = true;

			if (bearerToken) {
				const config = {
					headers: {
						Authorization: `Bearer ${bearerToken}`
					},
					timeout: apiTimeOut,
					maxContentLength: Infinity,
					maxBodyLength: Infinity
				};
				const res = await axios.get(finalUrl, config);
				if (res.error) {
					throw res.error;
				}
				logger.info(`API GET request -> ${finalUrl} ${(Date.now() - timeLog.startTime)}ms`);
				return res?.data?.data || [];
			}
			else {
				throw 'UI Token is missing';
			}
		} catch (err) {
			logger.error(`Error while API GET request ${finalUrl}, err: ${err}`);
			throw err.toString();
		}
	}

	global.api_service.put = async (req, url, body) => {
		const finalUrl = `${host}${url}`;
		const timeLog = [];
		timeLog.startTime = Date.now();
		try {
			const bearerToken = req?.cookies?.Authorization?.split(' ')[1] ||
				(req?.headers?.Authorization || req?.headers?.authorization)?.split(' ')[1] ||
				(req?.user?.Authorization || req?.user?.authorization)?.split(' ')[1];

			if (bearerToken) {
				const config = {
					headers: {
						Authorization: `Bearer ${bearerToken}`,
						...(req.promo_client && { Client: req.promo_client })
					},
					timeout: apiTimeOut,
					maxContentLength: Infinity,
					maxBodyLength: Infinity
				};
				const res = await axios.put(finalUrl, body, config);
				if (res.error) {
					throw res.error;
				}
				logger.info(`API PUT request -> ${finalUrl} ${(Date.now() - timeLog.startTime)}ms`);
				return res?.data?.data || [];
			}
			else {
				throw 'UI Token is missing';
			}
		} catch (err) {
			logger.error(`Error while API PUT request ${finalUrl}, err: ${err}`);
			throw err.toString();
		}
	}

	global.api_service.post = async (req, url, body) => {
		const finalUrl = `${host}${url}`;
		const timeLog = [];
		timeLog.startTime = Date.now();
		try {
			const bearerToken =true;

			if (bearerToken) {
				const config = {
					headers: {
						Authorization: `Bearer ${bearerToken}`,
						...(req.promo_client && { Client: req.promo_client })
					},
					timeout: apiTimeOut,
					maxContentLength: Infinity,
					maxBodyLength: Infinity
				};
				const res = await axios.post(finalUrl, body, config);
				if (res.error) {
					throw res.error;
				}
				logger.info(`API POST request -> ${finalUrl} ${(Date.now() - timeLog.startTime)}ms`);
				return res?.data?.data || [];
			}
			else {
				throw 'UI Token is missing';
			}
		} catch (err) {
			logger.error(`Error while API POST request ${finalUrl}, err: ${err}`);
			throw err.toString();
		}
	}

	global.api_service.delete = async (req, url) => {
		const finalUrl = `${host}${url}`;
		const timeLog = [];
		timeLog.startTime = Date.now();
		try {
			const bearerToken = req?.cookies?.Authorization?.split(' ')[1] ||
				(req?.headers?.Authorization || req?.headers?.authorization)?.split(' ')[1] ||
				(req?.user?.Authorization || req?.user?.authorization)?.split(' ')[1];

			if (bearerToken) {
				const config = {
					headers: {
						Authorization: `Bearer ${bearerToken}`,
						...(req.promo_client && { Client: req.promo_client })
					},
					timeout: apiTimeOut,
					maxContentLength: Infinity,
					maxBodyLength: Infinity
				};
				const res = await axios.delete(finalUrl, config);
				if (res.error) {
					throw res.error;
				}
				logger.info(`API DELETE request -> ${finalUrl} ${(Date.now() - timeLog.startTime)}ms`);
				return res?.data?.data || [];
			}
			else {
				throw 'UI Token is missing';
			}
		} catch (err) {
			logger.error(`Error while API DELETE request ${finalUrl}, err: ${err}`);
			throw err.toString();
		}
	}

	console.log(`API request service initialized  with ${apiTimeOut / 1000} seconds timeout`);
};
export default setupApiService;