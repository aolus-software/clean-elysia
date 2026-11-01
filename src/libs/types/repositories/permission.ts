export type PermissionList = {
	id: string;
	name: string;
	group: string;
	createdAt: Date;
	updatedAt: Date;
};

export type PermissionSelectOptions = {
	group: string;
	permissions: {
		id: string;
		name: string;
		group: string;
	}[];
};
