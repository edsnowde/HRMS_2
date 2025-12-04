// Application related constants and enums
// Exported so TypeScript consumers (apiClient, components) can use
// a canonical set of statuses without hard-coding strings everywhere.
export enum ApplicationStatus {
	Pending = 'pending',
	Submitted = 'submitted',
	Reviewed = 'reviewed',
	Shortlisted = 'shortlisted',
	Rejected = 'rejected',
	Hired = 'hired'
}

// Add other shared constants here as needed in future
