/**
 * XML Parser Interface
 * Abstracts XML parsing operations
 * Allows for different parser implementations or testing with mocks
 */
export interface IXmlParser {
	/**
	 * Parse XML string to JavaScript object
	 */
	parse<T = any>(xmlContent: string): T;
}
