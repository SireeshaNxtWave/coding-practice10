const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  //console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  //console.log(jwtToken);
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(400);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(selectUserQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatched) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
                state_id AS stateId,
                state_name AS stateName,
                population AS population 
             FROM state
            ORDER BY stateId;`;
  const dbResponse = await db.all(getStatesQuery);
  response.send(dbResponse);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT
            *
        FROM
            state
        WHERE
            state_id = ${stateId};`;
  const dbResponse = await db.get(getStateQuery);
  const result = {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  };

  response.send(result);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtId,
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
        INSERT INTO
            district (
            district_name,
            state_id,
            cases,
            cured,
            active,
            deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths});`;
  //console.log(addDistrictQuery);
  const dbResponse = await db.run(addDistrictQuery);
  //console.log(dbResponse.lastID);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT
            *
        FROM
            district
        WHERE
            district_id = ${districtId};`;
    const dbResponse = await db.get(getDistrictQuery);
    const result = {
      districtId: dbResponse.district_id,
      districtName: dbResponse.district_name,
      stateId: dbResponse.state_id,
      cases: dbResponse.cases,
      cured: dbResponse.cured,
      active: dbResponse.active,
      deaths: dbResponse.deaths,
    };

    response.send(result);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuerry = `
        DELETE FROM 
            district
        WHERE
            district_id = ${districtId};`;

    await db.run(deleteDistrictQuerry);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictDetailsQuery = `
        UPDATE
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths};`;
    const dbResponse = await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    //console.log(stateId);
    const getStateStaticsQuery = `
        SELECT
            SUM(district.cases) AS totalCases,
            SUM(district.cured) AS totalCured,
            SUM(district.active) AS totalActive,
            SUM(district.deaths) AS totalDeaths
        FROM district
        WHERE
            district.state_id = ${stateId};`;
    //console.log(getStateStaticsQuery);
    const dbResponse = await db.get(getStateStaticsQuery);
    //console.log(dbResponse);
    response.send(dbResponse);
  }
);

module.exports = app;
