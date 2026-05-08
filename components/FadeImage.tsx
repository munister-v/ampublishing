
import React, { useState } from 'react';

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
}

export const FadeImage: React.FC<FadeImageProps> = ({ className, containerClassName, alt, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${containerClassName || 'w-full h-full'}`}>
      {/* Placeholder / Skeleton */}
      <div 
        className={`absolute inset-0 bg-gray-200 transition-opacity duration-700 ${isLoaded ? 'opacity-0' : 'opacity-100'}`} 
      />
      
      <img
        {...props}
        alt={alt}
        className={`${className} transition-opacity duration-1000 ease-out-quart ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
};
