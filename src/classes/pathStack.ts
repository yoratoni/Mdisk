export class PathStack {
    private _stack: string[];
    private _absolutePath: string;

    /**
     * Constructor -> Creates a new StringStack.
     * Note: Used to track the paths of the files and directories
     * inside the Big File.
     * @param absolutePath The absolute path to the output directory.
     */
    constructor(absolutePath: string) {
        this._stack = [];

        if (absolutePath[absolutePath.length - 1] !== "/") {
            this._absolutePath = absolutePath + "/";
        } else {
            this._absolutePath = absolutePath;
        }
    }

    /**
     * Pushes a new relative path to the stack.
     * @param str The relative path to push.
     */
    public push(str: string) {
        this._stack.push(str);
    }

    /**
     * Pops the last relative path from the stack.
     * @returns The last relative path.
     */
    public pop(): string {
        return this._stack.pop() as string;
    }

    public reset(): string {
        this._stack = [];
        return this._absolutePath;
    }

    /**
     * Returns the stack (raw array).
     */
    public get stack(): string[] {
        return this._stack;
    }

    /**
     * Returns a generated path with the initial absolute path, based on the string stack.
     * @returns The generated path.
     */
    public generatePathFromStack(): string {
        let path = this._absolutePath;

        for (let i = 0; i < this._stack.length; i++) {
            path += this._stack[i] + "/";
        }

        return path;
    }
}