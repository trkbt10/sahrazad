/**
 * @file Vector DB connection factory.
 */
import { createNodeFileIO } from "vcdb/storage/node";
import { connect } from "vcdb/client";

export const createVectorDB = ({ baseDir, dim }: { baseDir: string; dim: number }) => {
  return connect({
    storage: {
      index: createNodeFileIO(baseDir + "/index"),
      data: createNodeFileIO(baseDir + "/data"),
    },
    database: {
      dim,
      metric: "cosine",
      strategy: "bruteforce",
    },
  });
};
