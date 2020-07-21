import React from "react";
import { Header, Select, Icon } from "semantic-ui-react";
import { mosaicOptions } from "./constants";

export default function InfoBox(props) {
  const { mosaicYearRange, onChange, zoomIn } = props;

  return (
    <div
      style={{
        position: "absolute",
        width: 300,
        maxWidth: 400,
        left: 5,
        top: 5,
        padding: 5,
        maxHeight: "70%",
        zIndex: 1,
        backgroundColor: "#fff",
        pointerEvents: "auto",
        overflowY: "auto",
        overflow: "visible",
      }}
    >
      <Header as="h3">Serverless High-Res Imagery</Header>
      <p>
        Serverless high-resolution{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.fsa.usda.gov/programs-and-services/aerial-photography/imagery-programs/naip-imagery/"
        >
          NAIP
        </a>{" "}
        map tiles, generated on demand from an{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://registry.opendata.aws/naip/"
        >
          AWS public dataset
        </a>{" "}
        of Cloud-Optimized GeoTIFFs.{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/kylebarron/naip-cogeo-mosaic"
        >
          <Icon name="github" />
          Github
        </a>
      </p>

      {zoomIn && (
        <p>
          <b> Zoom in to see imagery. </b>
        </p>
      )}
      <Select
        style={{ width: "100%" }}
        options={mosaicOptions}
        value={mosaicYearRange}
        onChange={(e, data) => onChange(data.value)}
      />
    </div>
  );
}
