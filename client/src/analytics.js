import ReactGA from 'react-ga';

const trackingId = "UA-120727651-10"; 
const CHECK_USE_TIME = 30000;
ReactGA.initialize(trackingId);

setTimeout(() => {
  ReactGA.event({
    category: 'Used',
    action: '30s'
  })
}, CHECK_USE_TIME);

export default ReactGA;