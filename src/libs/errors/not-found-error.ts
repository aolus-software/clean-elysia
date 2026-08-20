export class NotFoundError extends Error {
	code: number;

	/**
	 * Represents an error when a requested resource does not exist.
	 * @param {string} message - The error message.
	 */
	constructor(message: string = "Resource not found") {
		super(message);
		this.name = "NotFoundError";
		this.code = 404;
	}

	toResponse() {
		return Response.json(
			{
				status: 404,
				success: false,
				message: this.message || "Resource not found",
			},
			{
				status: 404,
			},
		);
	}
}
