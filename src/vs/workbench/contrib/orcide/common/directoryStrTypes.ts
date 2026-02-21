import { URI } from '../../../../base/common/uri.js';

export type OrcideDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: OrcideDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
