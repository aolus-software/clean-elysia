import { AppConfig, MailConfig } from "@config";
import { EmailOptions } from "@types";
import { log } from "@utils";
import fs from "fs";
import path from "path";

import { transporter } from "../transport";

export const EmailService = {
	async sendEmail(options: EmailOptions) {
		let htmlContent = options.html;

		// if the option is using template, we need to find the template and replace the key
		if (options.template) {
			try {
				const templatePath = path.join(
					__dirname,
					"templates",
					`${options.template}.html`,
				);
				htmlContent = fs.readFileSync(templatePath, "utf-8");

				// Replace variables in template
				if (options.variables) {
					Object.entries(options.variables).forEach(([key, value]) => {
						htmlContent = htmlContent?.replace(
							new RegExp(`{{${key}}}`, "g"),
							value,
						);
					});
				}
			} catch (error) {
				throw new Error("Error when parsing the template file", {
					cause: error,
				});
			}
		}

		// update title for dev / staging
		if (AppConfig.APP_ENV !== "production") {
			options.subject = `[${AppConfig.APP_ENV.toUpperCase()}] ${options.subject}`;
		}

		const mailOptions = {
			from: MailConfig.from || "noreply@yourapp.com",
			to: options.to,
			subject: options.subject,
			html: htmlContent,
			text: options.text,
		};

		log.info(
			{},
			`Sending email to ${options.to} with subject "${options.subject}"`,
		);

		return await transporter
			.sendMail({
				...mailOptions,
			})
			.then(() => {
				log.info(
					{},
					`Email sent to ${options.to} with subject "${options.subject}"`,
				);
			})
			.catch((error) => {
				log.error({}, `Failed to send email to ${options.to}:`);
				throw new Error("Failed to send email", {
					cause: error,
				});
			});
	},
};
