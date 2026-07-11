export interface PublicImage {
  id: string;
  fileName: string;
  contentType: string;
  contentUrl: string;
  thumbnailUrl: string | null;
}

export interface PublicImageSet {
  requestedImageId: string;
  images: PublicImage[];
}
