// core
import React, { useState, useEffect, useRef } from "react";
import _ from "lodash";

// images
import CategoryIcon from "../images/category";
import LegendImg from "../images/legend.svg";
import SearchIcon from "../images/icon-search.svg";
import SearchDisabledIcon from "../images/icon-search-disabled.svg";
import ToggleIcon from "../images/icon-toggle.svg";

import TextLoop from "react-text-loop";

// material-ui
import LinearProgress from "@material-ui/core/LinearProgress";
import Snackbar from "@material-ui/core/Snackbar";
import MuiAlert from "@material-ui/lab/Alert";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";

import Map from "../components/Map";

import analytics from "../analytics";

const categories = [
  { val: 0, name: "Supermarket" },
  { val: 1, name: "Shopping Mall" },
  { val: 2, name: "Restaurant" },
  { val: 3, name: "Cafe" },
  { val: 4, name: "Hospital" },
  { val: 5, name: "Pharmacy" },
  { val: 6, name: "Bank" },
];

const days = [
  { val: -1, name: "Live Data" },
  { val: 0, name: "Sunday" },
  { val: 1, name: "Monday" },
  { val: 2, name: "Tuesday" },
  { val: 3, name: "Wednesday" },
  { val: 4, name: "Thursday" },
  { val: 5, name: "Friday" },
  { val: 6, name: "Saturday" },
];

const times = [];
for (let i = 0; i < 24; i++) {
  const val = i;
  let name;
  if (i === 0) {
    name = "12 AM";
  } else if (i === 12) {
    name = "12 PM";
  } else {
    name = (i % 12) + (i < 12 ? " AM" : " PM");
  }
  times.push({ val, name });
}

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

function LocationSnackbar(props) {
  const { setSnackbarOpen, snackbarOpen } = props;

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setSnackbarOpen(false);
  };

  return (
    <div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={10000}
        onClose={handleClose}
      >
        <Alert onClose={handleClose} severity="warning">
          Please turn on your location services and refresh this page!
        </Alert>
      </Snackbar>
    </div>
  );
}

const getLocations = (category, latitude, longitude) => {
  return new Promise((resolve, reject) => {
    fetch(
      `/api/locations?category=${category}&latitude=${latitude}&longitude=${longitude}`
    )
      .then((res) => res.json())
      .then((locations) => resolve(locations));
  });
};

export default function Home() {
  useEffect(() => {
    analytics.ga("send", "pageview", "/");
  }, []);
  const [loading, setLoading] = useState(true);
  const allData = useRef([]);
  const [data, setData] = useState({ locations: [] });
  const mapCoords = useRef({ lat: null, lng: null });

  // for snackbar
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  // for search
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // for category
  const category = useRef(0);
  const [day, setDay] = useState(-1);
  const [time, setTime] = useState(null);
  const [dayAnchorEl, setDayAnchorEl] = useState(null);
  const [timeAnchorEl, setTimeAnchorEl] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // filter no time data
  const [excludeNoTimeData, setExcludeNoTimeData] = useState(false);

  useEffect(() => {
    if (excludeNoTimeData) {
      setData({ locations: filterDayTime(data.locations) });
    } else {
      setData({ locations: JSON.parse(JSON.stringify(allData.current)) });
    }
  }, [excludeNoTimeData]);

  useEffect(() => {
    setData({ locations: filterDayTime(allData.current) });
  }, [day, time]);

  const handleChangeDay = (event) => {
    setDay(event.target.value);
    if (event.target.value === -1) {
      setTime(null);
    } else {
      setTime(new Date().getHours());
    }
    setDayAnchorEl(null);
  };

  const handleChangeTime = (event) => {
    if (day === -1) {
      alert(
        "Please select the day of the week first and then set the time. " +
          "Currently you're viewing the 'Live Data'. This setting can be changed in the 'Day' menu."
      );
    } else {
      setTime(event.target.value);
      setTimeAnchorEl(null);
    }
  };

  const handleChangeText = (event) => {
    setSearchText(event.target.value);
  };

  const handleCloseDayMenu = (event) => {
    setDayAnchorEl(null);
  };

  const handleCloseTimeMenu = (event) => {
    setTimeAnchorEl(null);
  };

  const handleNoTimeData = () => {
    setExcludeNoTimeData(!excludeNoTimeData);
  };

  const handleSearch = async () => {
    setSearchLoading(true);
    const query = searchText;
    category.current = 0;
    setSearchText("");
    setExcludeNoTimeData(false);
    setDay(-1);
    setTime(null);

    const result = await getLocations(
      query,
      mapCoords.current.lat,
      mapCoords.current.lng
    );
    if (query && query !== '') {
      analytics.event({
        category: 'action',
        action: 'search',
        value: query,
      });
    }
    if (!result) {
      setSearchLoading(false);
      return;
    }

    // remove duplicates
    const data = {
      locations: _.uniqBy(
        result.locationInfoList,
        (val) => val.longitude + "," + val.latitude
      ),
    };

    // store non-filtered data
    allData.current = JSON.parse(JSON.stringify(data.locations));

    setData(data);
    setSearchLoading(false);
  };

  const handleMapCoordsChange = async () => {
    await fetchAndFilterData();
  };

  const handleCategoryChange = async (val) => {
    category.current = val;
    setCategoryLoading(true);
    await fetchAndFilterData();
    setCategoryLoading(false);
  };

  const fetchAndFilterData = async () => {
    if (!mapCoords.current.lat || !mapCoords.current.lng) {
      return;
    }
    const promises = [];
    promises.push(
      getLocations(
        categories[category.current].name,
        mapCoords.current.lat,
        mapCoords.current.lng
      )
    );
    if (category.current === 0) {
      promises.push(
        getLocations(
          "Grocery store",
          mapCoords.current.lat,
          mapCoords.current.lng
        )
      );
    }
    const result = await Promise.all(promises);
    if (!result || !result.length || !result[0].locationInfoList) {
      return; // setData({ locations: [] }) ?
    }

    const data = { locations: result[0].locationInfoList };

    // concat "Grocery store"
    if (result[1] && result[1].locationInfoList) {
      data.locations = data.locations.concat(result[1].locationInfoList);
    }

    // remove duplicates
    data.locations = _.uniqBy(
      data.locations,
      (val) => val.longitude + "," + val.latitude
    );

    // store non-filtered data
    allData.current = JSON.parse(JSON.stringify(data.locations));

    // exclude "no time data" and filter by current day, time settings
    if (excludeNoTimeData) {
      data.locations = filterDayTime(data.locations);
    }

    setData(data);
  };

  const filterDayTime = (data) => {
    if (!excludeNoTimeData) return data;
    if (day === -1) {
      return _.filter(data, (loc) => loc.nowStatus !== "No popular times data");
    } else {
      return _.filter(data, (loc) => {
        // If 'time' is set, check the status at the time of the day exists.
        // If not, check the status at the current time of user exists.
        if (loc.allStatus && loc.allStatus[day] && loc.allStatus[day].length) {
          // It should always be the case that time !== null here
          const stat = loc.allStatus[day].filter((stat) => {
            return stat.time === time;
          })[0];
          return stat && stat.status && stat.status !== "";
        } else {
          return false;
        }
      });
    }
  };

  return (
    <main>
      {/* Hero unit */}
      <div className="hero section">
        <div className="container">
          <h1 className="typography">
            Find{" "}
            <TextLoop className="textLoop" interval={2500}>
              <span className="_0">supermarkets </span>
              <span className="_1">shopping malls </span>
              <span className="_2">restaurants </span>
              <span className="_3">cafes </span>
              <span className="_4">hospitals </span>
              <span className="_5">pharmacies </span>
              <span className="_6">banks </span>
            </TextLoop>
            <br />
            near you that are not crowded!
          </h1>
          <h2>
            Based on{" "}
            <a
              className="link"
              href="https://support.google.com/business/answer/6263531?hl=en"
            >
              popular times data*
            </a>
            <br />
            from Google Maps
          </h2>
          <h4
            className="subtitle"
          >
            * Data might not be 100% accurate as it is obtained via web scraping
          </h4>
          <LocationSnackbar
            snackbarOpen={snackbarOpen}
            setSnackbarOpen={setSnackbarOpen}
          />
        </div>
      </div>
      <div className="map section">
        <div className="container">
          <div className="searchWrapper">
            <input
              placeholder={searchLoading ? "" : "Search places or addresses"}
              disabled={searchLoading}
              value={searchText}
              onChange={handleChangeText}
              onKeyPress={(event) => {
                if (event.key === "Enter") {
                  handleSearch();
                  event.preventDefault();
                }
              }}
            />
            {searchLoading && (
              <div className="loaderContainer">
                <i className="loader" />
              </div>
            )}
            <button onClick={handleSearch} disabled={searchLoading || categoryLoading}>
              {searchLoading || categoryLoading ? (
                <img src={SearchDisabledIcon} />
              ) : (
                <img src={SearchIcon} />
              )}
            </button>
          </div>

          <div className="categoryWrapper">
            {categories.map((item, index) => (
              <button
                onClick={() => handleCategoryChange(item.val)}
                key={index}
                disabled={categoryLoading || searchLoading}
                title={item.name}
              >
                {category.current === item.val && categoryLoading ? (
                  <div className="loaderContainer">
                    <i className="loader" />
                  </div>
                ) : (
                  <img
                    src={
                      category.current === item.val
                        ? CategoryIcon.select[item.val]
                        : CategoryIcon.unselect[item.val]
                    }
                  />
                )}
              </button>
            ))}
          </div>
          <div className="menuWrapper">
            <div className="group one">
              <button
                className="day"
                onClick={(event) => setDayAnchorEl(event.currentTarget)}
              >
                When:{" " + days[day + 1].name}
                <img src={ToggleIcon} />
              </button>
              <Menu
                id="select-day"
                onClose={handleCloseDayMenu}
                open={Boolean(dayAnchorEl)}
                anchorEl={dayAnchorEl}
                PaperProps={{
                  style: {
                    marginTop: 40,
                    boxShadow: "none",
                    borderRadius: 0,
                  },
                }}
              >
                {days.map((item, index) => (
                  <MenuItem
                    selected={day === item.val}
                    onClick={handleChangeDay}
                    value={item.val}
                    key={index}
                  >
                    {item.name}
                  </MenuItem>
                ))}
              </Menu>

              <button
                className="time"
                onClick={(event) => setTimeAnchorEl(event.currentTarget)}
              >
                Time:{" " + (time ? times[time].name : 'N/A')}
                <img src={ToggleIcon} />
              </button>
              <Menu
                id="select-time"
                onClose={handleCloseTimeMenu}
                open={Boolean(timeAnchorEl)}
                anchorEl={timeAnchorEl}
                PaperProps={{
                  style: {
                    maxHeight: 300,
                    marginTop: 40,
                    boxShadow: "none",
                    borderRadius: 0,
                  },
                }}
              >
                {times.map((item, index) => (
                  <MenuItem
                    selected={time === item.val}
                    onClick={handleChangeTime}
                    value={item.val}
                    key={index}
                  >
                    {item.name}
                  </MenuItem>
                ))}
              </Menu>
            </div>
            <div className="group two">
              <div className="toggle">
                <input
                  id="toggleData"
                  type="checkbox"
                  checked={excludeNoTimeData}
                  onChange={handleNoTimeData}
                />
                <label>Exclude no time data</label>
              </div>
              <img src={LegendImg} />
            </div>
          </div>
        </div>
      </div>
      {loading && <LinearProgress />}
      <Map
        data={data}
        day={day}
        time={time}
        mapCoords={mapCoords}
        loading={loading}
        setLoading={setLoading}
        handleMapCoordsChange={handleMapCoordsChange}
      />
    </main>
  );
}