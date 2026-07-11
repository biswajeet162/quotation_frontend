export interface PublicImage {
  id: string;
  fileName: string;
  contentType: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  brand?: string | null;
  designation?: string | null;
}

export interface PublicImageSet {
  requestedImageId: string;
  quotationNumber?: string | null;
  images: PublicImage[];
}
