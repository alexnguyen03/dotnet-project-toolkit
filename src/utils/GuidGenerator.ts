/**
 * GUID Generator Utility
 * Extracted from ProfileService to follow Single Responsibility Principle
 */
export class GuidGenerator {
	/**
	 * Generate a random GUID/UUID v4
	 */
	static generate(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
		});
	}
}
