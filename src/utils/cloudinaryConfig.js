import { Cloudinary } from '@cloudinary/url-gen';

// Create a Cloudinary instance
const cloudinary = new Cloudinary({
  cloud: {
    cloudName: 'dq9c8qsrw'
  },
  url: {
    secure: true // Force HTTPS
  }
});

export default cloudinary;
