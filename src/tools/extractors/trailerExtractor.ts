import { extractorChecker } from "helpers/files";


export default function TrailerExtractor(trailerFilePath: string, outputDirPath: string) {
    extractorChecker(trailerFilePath, "trailer video", ".mtx", outputDirPath);

    // TODO
}