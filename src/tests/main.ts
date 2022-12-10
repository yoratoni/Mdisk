import { expect } from "chai";

import { getAbsolutePath , getFileSize } from "helpers/files";


describe("getFileSize()", () => {
    let absolutePath = "";

    beforeEach(() => {
        absolutePath = getAbsolutePath("binary/sally_clean.bf");
    });

    it("should return the correct size of the file in bytes", () => {
        expect(getFileSize(absolutePath)).to.be.equal(2670911488);
    });
});