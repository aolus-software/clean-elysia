import { DateToolkit } from "../utils/date";

/**
 * Token lifetimes are functions, not constants. A constant here is evaluated
 * once when the module is first imported, which freezes the expiry to
 * "process start + N" — so every token minted after that window is issued
 * already expired. Call these at the point the token is created.
 */
export const accessTokenLifetime = (): Date =>
	DateToolkit.addHours(DateToolkit.now(), 1).toDate();

export const verificationTokenLifetime = (): Date =>
	DateToolkit.addHours(DateToolkit.now(), 1).toDate();

export const resetPasswordLifetime = (): Date =>
	DateToolkit.addHours(DateToolkit.now(), 1).toDate();

export const autoDeleteTokenLifetime = (): Date =>
	DateToolkit.addMonths(DateToolkit.now(), 1).toDate();
