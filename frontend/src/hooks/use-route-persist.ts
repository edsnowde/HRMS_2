import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useRoutePersist = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // On page load or refresh, check for saved path
    const savedPath = sessionStorage.getItem('lastPineconeScoringPath');
    if (savedPath && window.location.pathname !== savedPath) {
      navigate(savedPath);
    }
  }, [navigate]);
};