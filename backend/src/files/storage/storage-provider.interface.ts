import 'multer';
export interface StorageProvider {
  /**
   * Uploads a file to the storage provider.
   * @param file The file buffer or multer object
   * @param storageKey The internal unique key to store the file as
   * @param mimeType The file's mime type
   * @returns The public or presigned download URL (or key if provider requires generation)
   */
  upload(
    file: Buffer | Express.Multer.File,
    storageKey: string,
    mimeType: string,
  ): Promise<string>;

  /**
   * Deletes a file from the storage provider.
   * @param storageKey The internal unique key
   */
  delete(storageKey: string): Promise<void>;

  /**
   * Retrieves a download URL for the file.
   * @param storageKey The internal unique key
   */
  getDownloadUrl(storageKey: string): Promise<string>;
}
