export type RoleList = {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
};

export type RoleDetail = {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	permissions: {
		group: string;
		names: {
			id: string;
			name: string;
			isAssigned: boolean;
		}[];
	}[];
};
