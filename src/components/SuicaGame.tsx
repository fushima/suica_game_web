import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import './SuicaGame.css';

interface Ball {
  body: Matter.Body;
  level: number;
}

const BALL_CONFIGS = [
  { radius: 20, color: '#FF6B6B' },  // レベル1: 赤・小
  { radius: 30, color: '#4ECDC4' },  // レベル2: 青緑・中
  { radius: 45, color: '#45B7D1' },  // レベル3: 青・大
];

const SuicaGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const ballsRef = useRef<Map<number, Ball>>(new Map());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextBallLevel, setNextBallLevel] = useState(0);
  const [canDrop, setCanDrop] = useState(true);
  const [dropPosition, setDropPosition] = useState(400);

  const createBall = useCallback((x: number, y: number, level: number): Ball => {
    const config = BALL_CONFIGS[level];
    const body = Matter.Bodies.circle(x, y, config.radius, {
      restitution: 0.3,
      friction: 0.1,
      density: 0.001,
      label: `ball-${level}`,
      render: {
        fillStyle: config.color,
      },
    });
    
    return { body, level };
  }, []);

  const checkGameOver = useCallback(() => {
    const bodies = Matter.Composite.allBodies(engineRef.current!.world);
    const gameBalls = bodies.filter(body => body.label.startsWith('ball-'));
    
    for (const ball of gameBalls) {
      if (ball.position.y < 100) {
        setGameOver(true);
        return true;
      }
    }
    return false;
  }, []);

  const mergeBalls = useCallback((ballA: Ball, ballB: Ball) => {
    if (ballA.level !== ballB.level || ballA.level >= BALL_CONFIGS.length - 1) {
      return;
    }

    const midX = (ballA.body.position.x + ballB.body.position.x) / 2;
    const midY = (ballA.body.position.y + ballB.body.position.y) / 2;
    
    Matter.World.remove(engineRef.current!.world, [ballA.body, ballB.body]);
    ballsRef.current.delete(ballA.body.id);
    ballsRef.current.delete(ballB.body.id);
    
    const newLevel = ballA.level + 1;
    const newBall = createBall(midX, midY, newLevel);
    Matter.World.add(engineRef.current!.world, newBall.body);
    ballsRef.current.set(newBall.body.id, newBall);
    
    const points = (newLevel + 1) * 10;
    setScore(prev => prev + points);
  }, [createBall]);

  const dropBall = useCallback(() => {
    if (!canDrop || gameOver || !engineRef.current) return;
    
    const ball = createBall(dropPosition, 50, nextBallLevel);
    Matter.World.add(engineRef.current.world, ball.body);
    ballsRef.current.set(ball.body.id, ball);
    
    setCanDrop(false);
    setTimeout(() => {
      setCanDrop(true);
      setNextBallLevel(Math.floor(Math.random() * 2));
    }, 500);
  }, [canDrop, gameOver, nextBallLevel, dropPosition, createBall]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      setDropPosition(Math.max(30, Math.min(770, x)));
    }
  }, []);

  const resetGame = useCallback(() => {
    if (engineRef.current) {
      const bodies = Matter.Composite.allBodies(engineRef.current.world);
      const gameBalls = bodies.filter(body => body.label.startsWith('ball-'));
      Matter.World.remove(engineRef.current.world, gameBalls);
      ballsRef.current.clear();
    }
    setScore(0);
    setGameOver(false);
    setCanDrop(true);
    setNextBallLevel(0);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 0.6;
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: containerRef.current,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false,
        background: '#F8F8F8',
      },
    });
    renderRef.current = render;

    const ground = Matter.Bodies.rectangle(400, 590, 800, 20, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });
    
    const leftWall = Matter.Bodies.rectangle(10, 300, 20, 600, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });
    
    const rightWall = Matter.Bodies.rectangle(790, 300, 20, 600, {
      isStatic: true,
      render: { fillStyle: '#333' },
    });

    Matter.World.add(engine.world, [ground, leftWall, rightWall]);

    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        if (bodyA.label.startsWith('ball-') && bodyB.label.startsWith('ball-')) {
          const ballA = ballsRef.current.get(bodyA.id);
          const ballB = ballsRef.current.get(bodyB.id);
          
          if (ballA && ballB && ballA.level === ballB.level) {
            mergeBalls(ballA, ballB);
          }
        }
      });
    });

    Matter.Events.on(engine, 'afterUpdate', () => {
      checkGameOver();
    });

    Matter.Render.run(render);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
    };
  }, [mergeBalls, checkGameOver]);

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="score">スコア: {score}</div>
        <button onClick={resetGame} className="reset-button">リセット</button>
      </div>
      
      {canDrop && !gameOver && (
        <div 
          className="next-ball-preview" 
          style={{ 
            left: `${dropPosition - 15}px`,
            backgroundColor: BALL_CONFIGS[nextBallLevel].color,
            width: `${BALL_CONFIGS[nextBallLevel].radius}px`,
            height: `${BALL_CONFIGS[nextBallLevel].radius}px`,
          }}
        />
      )}
      
      <div
        ref={containerRef}
        onClick={dropBall}
        onMouseMove={handleMouseMove}
        className="game-canvas-container"
        style={{ position: 'relative', cursor: 'pointer' }}
      />
      
      {gameOver && (
        <div className="game-over">
          <h2>ゲームオーバー!</h2>
          <p>最終スコア: {score}</p>
          <button onClick={resetGame}>もう一度プレイ</button>
        </div>
      )}
    </div>
  );
};

export default SuicaGame;