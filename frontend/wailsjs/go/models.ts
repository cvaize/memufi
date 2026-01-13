export namespace main {
	
	export class DirectoryTreeResponse {
	    Items: string[];
	    Error: string;
	
	    static createFrom(source: any = {}) {
	        return new DirectoryTreeResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Items = source["Items"];
	        this.Error = source["Error"];
	    }
	}

}

