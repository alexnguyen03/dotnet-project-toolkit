import { XMLParser } from 'fast-xml-parser';
import { IXmlParser } from './IXmlParser';

/**
 * Fast XML Parser Implementation
 * Wrapper around fast-xml-parser library
 */
export class FastXmlParser implements IXmlParser {
    private readonly parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseTagValue: true,
            trimValues: true
        });
    }

    parse<T = any>(xmlContent: string): T {
        return this.parser.parse(xmlContent) as T;
    }
}
