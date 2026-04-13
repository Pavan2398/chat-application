import { getAvatarUrl } from "../../lib/utils";

const Avatar = ({ src, alt, className, onError }) => {
  const handleError = (e) => {
    if (onError) {
      onError(e);
    } else {
      e.target.src = getAvatarUrl(null);
    }
  };

  return (
    <img
      src={getAvatarUrl(src)}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};

export default Avatar;