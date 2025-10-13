"use server";

import appConfig from "@/lib/config/config";


export async function getAppConfig() {
	return appConfig;
}
